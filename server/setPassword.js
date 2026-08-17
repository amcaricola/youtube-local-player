import { saveConfig } from './config.js';
import { hashPassword } from './auth.js';

// Recuperación manual del acceso (si se pierde la contraseña maestra):
//   npm run password -- "nueva-clave"   → establece/cambia la contraseña
//   npm run password                    → elimina la protección por completo
// El servidor relee .config.json en cada petición, así el cambio es inmediato.
const pw = process.argv[2];
saveConfig({ masterPasswordHash: pw ? hashPassword(pw) : null });
console.log(pw ? `Contraseña maestra actualizada (hash scrypt guardado).` : 'Contraseña maestra eliminada: acceso abierto.');