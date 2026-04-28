# Flujos del sistema — Agendapp Backend

Este documento explica cómo se implementan en el repositorio los tres flujos principales que el bot automatiza contra el portal web de EPS Sura.

---

## Requisito previo: autenticación

Antes de ejecutar cualquiera de los tres flujos debes tener una sesión activa.  
Llama al endpoint de login y conserva el `sessionId` que devuelve; lo necesitarás en todas las peticiones posteriores.

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "epsId": "sura",
  "documentType": "C",
  "documentNumber": "TU_DOCUMENTO",
  "password": "TU_CONTRASEÑA"
}
```

Respuesta exitosa:
```json
{
  "ok": true,
  "data": {
    "success": true,
    "sessionId": "ec6d6279-...",
    "message": "Autenticación exitosa"
  }
}
```

El flujo interno de autenticación se encuentra en:

| Archivo | Responsabilidad |
|---|---|
| `src/controllers/auth.controller.ts` | Recibe la petición HTTP y devuelve la respuesta |
| `src/services/auth.service.ts` | Orquesta el login y crea la sesión local |
| `src/infraestructure/browser/login.service.ts` | Conduce Playwright contra el formulario de Sura |
| `src/infraestructure/browser/session.store.ts` | Almacena en memoria la sesión (contexto + página) |

---

## 1. Seleccionar personas

**¿Qué hace?**  
Al ingresar al módulo de citas, Sura muestra un `<select>` con el grupo familiar del afiliado. El bot espera a que ese desplegable sea visible y selecciona automáticamente al primer integrante (índice 1).

**Código relevante:** `src/infraestructure/browser/appointments.service.ts`, función `beginAppointmentBooking`.

```typescript
// Esperar a que el desplegable de beneficiario esté visible
const beneficiarioSelect = page.locator('select').first();
await beneficiarioSelect.waitFor({ state: 'visible', timeout: 15_000 });

// Seleccionar al paciente en la posición 1
await beneficiarioSelect.selectOption({ index: 1 });
```

**Modal intermedio**  
Justo después de seleccionar la persona, Sura puede mostrar un modal titulado *"Somos tu experto aliado"* con un botón **ENTENDIDO**. El bot lo detecta y lo cierra automáticamente:

```typescript
const entendidoBtn = page.locator('button:has-text("ENTENDIDO")').first();
await entendidoBtn.waitFor({ state: 'visible', timeout: 10_000 });
await entendidoBtn.click();
```

Si el modal no aparece (el portal lo omite), el bot continúa sin interrupciones.

---

## 2. Seleccionar tipo de cita / cita

El flujo de selección de cita se divide en dos pasos.

### 2.1 Ingresar al módulo de citas

El selector CSS que apunta a la tarjeta *"Citas Médico General"* está centralizado en `src/infraestructure/browser/selectors.ts`:

```typescript
export const homeSelectors: HomeSelectors = {
  citasMedicoGeneralCard:
    'a.card-link.mas_utilizados[ui-sref="solicitudes/seleccionGrupoHada"]',
};
```

El bot hace clic en esa tarjeta para abrir el módulo:

```typescript
await page.locator(homeSelectors.citasMedicoGeneralCard)
  .waitFor({ state: 'visible', timeout: 15_000 });
await page.locator(homeSelectors.citasMedicoGeneralCard).click();
```

### 2.2 Consultar disponibilidad

Una vez dentro del módulo (y después de seleccionar la persona), aparece un formulario con el botón **"Consultar disponibilidad"**. El bot lo localiza y hace clic:

```typescript
const consultarBtn = page.locator(
  'button:has-text("Consultar disponibilidad"), a:has-text("Consultar disponibilidad")'
).first();
await consultarBtn.waitFor({ state: 'visible', timeout: 20_000 });
await consultarBtn.click();
```

### 2.3 Modal de fecha deseada

Sura abre un segundo modal pidiendo la fecha. El bot rellena automáticamente el campo `input[type="date"]` con la fecha del día siguiente y confirma:

```typescript
const manana = new Date();
manana.setDate(manana.getDate() + 1);
const formatoLargo = `${yyyy}-${mm}-${dd}`; // AAAA-MM-DD

const dateInput = page.locator('input[type="date"]');
await dateInput.fill(formatoLargo);

const botonConsultarDentroDeModal = page.locator(
  'button:has-text("Consultar disponibilidad de citas")'
);
await botonConsultarDentroDeModal.click();
```

**Endpoint que dispara este flujo completo:**

```http
POST http://localhost:3000/api/citas/agendar
Content-Type: application/json
x-session-id: TU_SESSION_ID

{
  "especialidadUrl": "medicina-general",
  "fechaDeseada": "2026-05-10",
  "horaDeseada": "14:00"
}
```

> **Nota:** Los campos `especialidadUrl`, `fechaDeseada` y `horaDeseada` están definidos en `src/types/appointments.types.ts` pero actualmente el servicio usa la fecha del día siguiente de forma automática. En futuras versiones estos valores serán leídos desde el body de la petición.

---

## 3. Cancelamiento de cita

### Estado actual de la implementación

El flujo actual **no cancela** una cita previamente agendada; lo que hace es:

1. Abrir el módulo de citas.
2. Seleccionar la persona.
3. Intentar consultar disponibilidad.
4. Detectar el mensaje de Sura *"EN ESTE MOMENTO NO HAY CITAS DISPONIBLES"*.
5. Cerrar el modal de alerta.
6. Cerrar sesión de forma controlada.

El código que cierra el modal de respuesta y la sesión es:

```typescript
// Cerrar el modal de alerta de "no hay citas"
const closeAlertBtn = page.locator(
  '#information button.close, #information .close, #information [aria-label="Close"]'
).first();
await closeAlertBtn.click();
await page.locator('#information').waitFor({ state: 'hidden', timeout: 10_000 });

// Clic en el botón rojo "Cerrar sesión"
const cerrarSesionBtn = page.locator(
  'button:has-text("Cerrar sesión"), a:has-text("Cerrar sesión")'
).first();
await cerrarSesionBtn.click({ force: true });

// Confirmar salida en el modal emergente
const confirmarSalirBtn = page.locator(
  'button:has-text("Si"), button:text-is("Si"), button:text-is("SI")'
).first();
await confirmarSalirBtn.click({ force: true });
```

### Cierre de sesión manual (logout)

Si el usuario desea destruir la sesión del bot desde la API (sin pasar por el módulo de citas), puede llamar al endpoint de logout:

```http
POST http://localhost:3000/api/auth/logout
Content-Type: application/json
x-session-id: TU_SESSION_ID
```

Este endpoint requiere el middleware `requireSession` (definido en `src/middleware/auth/session.middleware.ts`), que valida el header `x-session-id` antes de ejecutar la lógica del controlador.

### Próximos pasos para implementar cancelación real

Para añadir la cancelación de una cita ya agendada habría que:

1. Agregar un nuevo servicio en `src/infraestructure/browser/appointments.service.ts` (p. ej. `cancelAppointment`).
2. Navegar dentro del portal Sura al módulo de **"Mis citas"**.
3. Localizar la cita deseada por fecha/especialidad y hacer clic en el botón de cancelar.
4. Confirmar la cancelación en el modal de Sura.
5. Exponer un nuevo endpoint (p. ej. `DELETE /api/citas/:citaId`) en `src/index.ts` y su controlador en `src/controllers/appointments.controller.ts`.

---

## Resumen de archivos clave

| Archivo | Flujo |
|---|---|
| `src/index.ts` | Registro de rutas HTTP |
| `src/controllers/auth.controller.ts` | Login / Logout |
| `src/controllers/appointments.controller.ts` | Agendar cita |
| `src/services/auth.service.ts` | Lógica de sesión |
| `src/infraestructure/browser/login.service.ts` | Automatización del login en Sura |
| `src/infraestructure/browser/appointments.service.ts` | Selección de persona, tipo de cita y consulta |
| `src/infraestructure/browser/selectors.ts` | Selectores CSS del portal |
| `src/infraestructure/browser/session.store.ts` | Almacén en memoria de sesiones activas |
| `src/middleware/auth/session.middleware.ts` | Validación del header `x-session-id` |
| `src/types/appointments.types.ts` | Tipado de la petición de citas |
