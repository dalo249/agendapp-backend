import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { loginHandler, logoutHandler } from './controllers/auth.controller.js';
import { agendarCitaHandler } from './controllers/appointments.controller.js';
import { requireSession } from './middleware/auth/session.middleware.js';

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/auth/login', loginHandler);
app.post('/api/auth/logout', requireSession, logoutHandler);
// Agregamos nueva ruta para manejar el módulo de citas
app.post('/api/citas/agendar', requireSession, agendarCitaHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Servidor escuchando en el puerto ${PORT}`);
});
