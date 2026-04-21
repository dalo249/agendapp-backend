import { Page } from '@playwright/test';
import { homeSelectors } from './selectors.js';
import { logger } from '../../utils/logger.js';

export async function beginAppointmentBooking(page: Page): Promise<{ success: boolean, modalText?: string }> {
  logger.info('[Appointments] Ingresando al módulo de Citas Médico General...');

  try {
    // Esperar a que el botón de "Citas Médico General" esté visible en el portal
    await page.locator(homeSelectors.citasMedicoGeneralCard).waitFor({ state: 'visible', timeout: 15_000 });
    
    // Clic en el módulo de Citas
    await page.locator(homeSelectors.citasMedicoGeneralCard).click();
    logger.info('[Appointments] Clic realizado. Módulo de citas abierto.');

    // 1. Pantalla intermedia: Seleccionar la persona del grupo familiar
    logger.info('[Appointments] Esperando la lista de selección de beneficiario...');
    const beneficiarioSelect = page.locator('select').first();
    await beneficiarioSelect.waitFor({ state: 'visible', timeout: 15_000 });
    
    // Seleccionamos al paciente en la posición 1
    logger.info('[Appointments] Seleccionando al paciente...');
    await beneficiarioSelect.selectOption({ index: 1 });

    // 1.5. Modal intermedio "Somos tu experto aliado" que sale AL SELECCIONAR LA PERSONA
    logger.info('[Appointments] Verificando si aparece el modal de "ENTENDIDO" tras seleccionar...');
    try {
      const entendidoBtn = page.locator('button:has-text("ENTENDIDO")').first();
      // Esperamos hasta 10 segundos por si el modal salta
      await entendidoBtn.waitFor({ state: 'visible', timeout: 10_000 });
      await entendidoBtn.click();
      logger.info('[Appointments] Clic en "ENTENDIDO" realizado exitosamente.');
    } catch (e) {
      logger.info('[Appointments] No apareció el modal "ENTENDIDO" o cargó directo.');
    }

    // 2. Esperar a que cargue el formulario final de Asignación de citas
    logger.info('[Appointments] Esperando botón de "Consultar disponibilidad"...');
    const consultarBtn = page.locator('button:has-text("Consultar disponibilidad"), a:has-text("Consultar disponibilidad")').first();
    await consultarBtn.waitFor({ state: 'visible', timeout: 20_000 });
    
    // 2. Clic en "Consultar disponibilidad"
    logger.info('[Appointments] Dando clic en Consultar disponibilidad...');
    await consultarBtn.click();

    // 2.5 Modal intermedio de Selección de Fecha (NUEVO PASO DETECTADO)
    logger.info('[Appointments] Esperando modal de "FECHA PARA LA CUAL EL USUARIO SOLICITA"...');
    const modalFechaDeseada = page.locator('text=/Fecha deseada de la cita/i').first();
    await modalFechaDeseada.waitFor({ state: 'visible', timeout: 10_000 });
    
    // Rellenamos una fecha de ejemplo en el input de fecha (Mañana)
    logger.info('[Appointments] Ingresando una fecha de ejemplo...');
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mm = String(manana.getMonth() + 1).padStart(2, '0');
    const dd = String(manana.getDate()).padStart(2, '0');
    const yyyy = manana.getFullYear();
    const formatoLargo = `${yyyy}-${mm}-${dd}`; // El input type="date" usa AAAA-MM-DD nativamente

    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill(formatoLargo);

    // Clic al boton azul de Consultar disponibilidad de citas dentro del segundo modal
    const botonConsultarDentroDeModal = page.locator('button:has-text("Consultar disponibilidad de citas")');
    await botonConsultarDentroDeModal.click();

    // 3. Esperar el modal de "MENSAJE DE USUARIO" que dice que no hay citas
    logger.info('[Appointments] Esperando mensaje de alerta de citas...');
    const alertaText = page.locator('text=/EN ESTE MOMENTO NO HAY CITAS DISPONIBLES/i').first();
    await alertaText.waitFor({ state: 'visible', timeout: 15_000 });
    
    // Extraer el texto completo del cuadro para devolverlo en la API
    const mensajeReal = await alertaText.textContent();
    logger.info(`[Appointments] Alerta detectada: ${mensajeReal}`);

    // Cerrar el modal amarillo dándole a la 'X' para desbloquear la pantalla
    logger.info('[Appointments] Cerrando ventana de alerta para poder continuar...');
    // El log mostró que el modal tiene id="information"
    const closeAlertBtn = page.locator('#information button.close, #information .close, #information [aria-label="Close"]').first();
    await closeAlertBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await closeAlertBtn.click();
    await page.locator('#information').waitFor({ state: 'hidden', timeout: 10_000 });

    // 4. Cerrar sesión dando clic al botón rojo "Cerrar sesión"
    logger.info('[Appointments] Dando clic en "Cerrar sesión"...');
    // Forzamos el click sin importar si hay bloqueos invisibles para evitar problemas
    const cerrarSesionBtn = page.locator('button:has-text("Cerrar sesión"), a:has-text("Cerrar sesión")').first();
    await cerrarSesionBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await cerrarSesionBtn.click({ force: true });

    // 5. Confirmar cierre de sesión en el modal emergente "¿ESTA SEGURO QUE DESEA SALIR DE LA APLICACION?"
    logger.info('[Appointments] Confirmando la salida en el modal final...');
    // Sura usa minúsculas y mayúsculas, usaremos RegExp /Si/i para hacer match exacto de ese botón azul
    const confirmarSalirBtn = page.locator('button:has-text("Si"), button:text-is("Si"), button:text-is("SI")').first();
    await confirmarSalirBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await confirmarSalirBtn.click({ force: true });

    logger.info('[Appointments] Flujo completado. Sesión cerrada desde el portal.');
    
    return { success: true, modalText: mensajeReal || 'ALERTA: NO HAY CITAS DISPONIBLES' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Appointments] Error al intentar consultar citas: ${message}`);
    return { success: false };
  }
}
