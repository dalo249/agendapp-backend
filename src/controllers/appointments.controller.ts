import { Request, Response } from 'express';
import { beginAppointmentBooking } from '../infraestructure/browser/appointments.service.js';
import { logger } from '../utils/logger.js';

/**
 * Agendar cita en EPS SURA para un usuario con sesión activa
 * Body: { especialidadUrl, fechaDeseada, horaDeseada }
 * RequireSession es obligatorio
 */
export async function agendarCitaHandler(req: Request, res: Response): Promise<void> {

  // Obtenemos la sesion del Request activo (gracias a requireSession)
  const session = req.activeSession!;
  const page = session.page;

  logger.info(`[AppointmentsController] Invocando agendar cita para sessionId: ${session.sessionId}`);
  
  try {
    const result = await beginAppointmentBooking(page);

    if (result.success) {
      // Respuesta de simulación exitosa basándonos en tu captura
      res.status(200).json({ 
        ok: true, 
        message: 'Consulta realizada con éxito: Sura reporta que no hay citas.',
        data: {
          estado: 'SIN_CITAS',
          mensajeSura: result.modalText,
          accion: 'El bot detectó el mensaje de Sura, presionó Cerrar Sesión y finalizó exitosamente.'
        }
      });
    } else {
      res.status(500).json({ ok: false, error: 'Hubo un error automatizando la consulta de la cita en Sura o los botones no aparecieron.' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, error: message });
  }
}
