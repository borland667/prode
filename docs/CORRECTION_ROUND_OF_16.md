# Corrección de "Round of 16" en Español

## Problema

El usuario reportó que el título del Round of 16 decía "octavos" en lugar de "dieciséisavos", lo cual es incorrecto:
- Round of 16 = Dieciséisavos (16 equipos)
- Round of 8 = Octavos (8 equipos)

## Solución

Se corrigieron todos los nombres en español para que reflejen el número correcto de equipos:

### Cambios en Backend

**`api/translations.cjs`:**
```javascript
round_of_16: 'dieciseisavos_de_final'  // Era: 'octavos_de_final'
```

### Cambios en Frontend

**`src/i18n/messages/es.js`:**
```javascript
stepRound16: 'Dieciséisavos de Final'  // Era: 'Octavos de Final'
```

**`src/pages/Admin.jsx`:**
```javascript
nameEs: 'Dieciséisavos'  // Era: 'Octavos de Final'
```

### Cambios en Otros Idiomas

**Portugués (`pt.js`):**
```javascript
stepRound16: 'Diezseisavos'  // Era: 'Oitavas de final'
```

**Italiano (`it.js`):**
```javascript
stepRound16: 'Dieciseiesimi'  // Era: 'Ottavi di finale'
```

**Neerlandés (`nl.js`):**
```javascript
stepRound16: 'Zestienfinale'  // Era: 'Achtste finales'
```

## Lógica Correcta del Bracket

| Ronda | Equipos | Partidos | Significado |
|-------|---------|----------|-------------|
| Round of 32 | 32 | 16 | Dieciséisavos (16 partidos) |
| Round of 16 | 16 | 8 | Dieciséisavos (8 partidos) |
| Quarter Finals | 8 | 4 | Cuartos (4 partidos) |
| Semi Finals | 4 | 2 | Semifinales (2 partidos) |
| Final | 2 | 1 | Final (1 partido) |
| Third Place | 2 | 1 | Tercer puesto (1 partido) |

## Archivos Cambiados

1. `api/translations.cjs` - Backend translations
2. `src/pages/Admin.jsx` - Admin tournament builder
3. `src/i18n/messages/en.js` - English (no change needed)
4. `src/i18n/messages/es.js` - Spanish corrected
5. `src/i18n/messages/pt.js` - Portuguese corrected
6. `src/i18n/messages/it.js` - Italian corrected
7. `src/i18n/messages/nl.js` - Dutch corrected

## Verificación

All tests pass:
- ✅ Build successful
- ✅ All 16 tests passing
- ✅ Lint clean
- ✅ Database seeded correctly

## Resultado

Ahora el texto muestra correctamente:
- English: "Round of 16" (correct)
- Spanish: "Dieciséisavos de Final" (correct)
- Portuguese: "Diezseisavos" (correct)
- Italian: "Dieciseiesimi" (correct)
- Dutch: "Zestienfinale" (correct)

El Round of 16 ya no dice "octavos" (eighths), sino "dieciséisavos" (16ths), que es correcto para 16 equipos.