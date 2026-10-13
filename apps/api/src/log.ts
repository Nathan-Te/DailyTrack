/**
 * Journaux structurés, courts : une ligne JSON par événement sur la sortie standard (Cloud Run / Cloud Logging lit `severity` et
 * `message`). Jamais de secret, de rediffusion, de pseudo ni d'adresse : seulement ce qu'il faut pour comprendre un incident.
 * Les lectures ordinaires (le Salon en fait une toutes les 5 s par joueur) ne sont pas journalisées.
 */
export type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export type Logger = (severity: Severity, message: string, fields?: Record<string, string | number | boolean | null>) => void;

export const consoleLog: Logger = (severity, message, fields = {}) => {
  const line = JSON.stringify({ severity, message, ...fields });
  if (severity === "ERROR" || severity === "WARNING") console.error(line);
  else console.log(line);
};

export const silentLog: Logger = () => {};
