# El Puerto de Plugins, explicado en cristiano

> Sin tecnicismos. Con metáforas. Para entender **qué** estamos haciendo y **por qué**,
> aunque no seas muy técnico. Si algo te suena a chino, busca la palabra en el
> **glosario** del final.

---

## 1. ¿Qué es esto, en una frase?

Una forma de que **cualquiera de la comunidad fabrique "enchufes" para el Motor**
(lo que llamamos *plugins*) usando todos el mismo formato — y de poder **instalarlos,
encenderlos y apagarlos** sin romper nada.

Piensa en el Motor como un **panel** (tu dashboard). Hoy, para añadirle algo nuevo,
hay que meter mano por dentro. Con el puerto, le metes un **enchufe** por fuera.

---

## 2. ¿Qué es un "plugin" aquí?

Una pieza suelta que se enchufa al panel. Puede ser:

- una **neurona** → trae datos de fuera (ej: la Porra del Mundial),
- un **panel** → una pantalla/herramienta propia (ej: notas),
- un **skin** → cambia el aspecto del panel (ej: el Personalizador),
- una **herramienta** → algo que trabaja por detrás, sin pantalla.

Cada plugin trae una **etiqueta** (el *manifiesto*) que dice quién es, qué hace y qué
permisos necesita. Esa etiqueta es lo único obligatorio y estándar; lo demás es libre.

---

## 3. Los 5 ejemplos reales que nos enseñaron el camino

No diseñamos a ciegas. Miramos cosas que la gente **ya había hecho**:

1. **Porra del Mundial** — se conecta a una web y trae tus datos. → "datos remotos".
2. **Radar de Pendientes** (de una amiga) — un programita que lee tu ordenador y te
   resume lo que dejaste a medias. Sus datos son **privados, no se suben**. → "datos locales".
3. **Personalizador** — cambia colores y tipografía del panel, en vivo. → "skin".
4. **Analizador de YouTube** — una mini-app que **le pregunta a Claude** y busca en la web.
5. **Herramienta de prospección** — otra mini-app que también **le pregunta a Claude**.

La lección grande: **muchísimas de estas cosas le hablan a Claude.** Apunta eso, que es la clave del "puente".

---

## 4. El problema de los artefactos (y la idea estrella: el puente)

Las mini-apps de Claude (los *artefactos*) **le preguntan a Claude desde el navegador**.
Dentro de claude.ai eso funciona porque la propia web les hace de intermediario. Pero si
sacas ese artefacto y lo metes en el Motor, **se queda sin intermediario** y su botón de
"preguntar a Claude" no hace nada. Muerto.

Lo que tu amiga moshiscanada evitó ("pedir una API key arruina cualquier herramienta de
comunidad") **vuelve a aparecer** al mudar el artefacto de casa.

### La metáfora de la cabina 🎙️

Imagina el artefacto como un **invitado en una cabina insonorizada** (aislada, por seguridad).
Quiere preguntarle algo a Claude, pero no puede salir.

- **El "shim"** (esto **ya está hecho**, va dentro del artefacto) = un **intercomunicador**.
  El invitado aprieta el botón y dice su pregunta hacia fuera.
- **El "host del puente"** (esto **falta**) = el **mayordomo al otro lado**, que trabaja para
  el Motor. Oye la pregunta, **se la hace a Claude usando el Claude que ya tiene el Motor**,
  y le devuelve la respuesta al invitado.

```
[artefacto en la cabina]  ──"pregúntale esto a Claude"──▶  [host del puente = mayordomo]
        (shim ✅)                                            (esto falta ❌)
                          ◀──────── respuesta ──────────      └─ usa el Claude del Motor
```

**Por qué importa:** así un artefacto de la comunidad **cobra vida dentro del Motor sin que
nadie ponga una API key.** El Motor presta su Claude. Esa es la magia del puerto.

---

## 5. El modelo WordPress (y por qué el puente puede ser un plugin)

WordPress funciona así: hay un **"core"** (núcleo) pequeño, y **casi todo lo demás son
plugins.** Tú instalas plugins para lo que quieras… pero ese core es **el que carga los
plugins**. Sin él, no habría plugins.

Aquí igual:

```
Motor
 └─ cargador de plugins        ← se mete UNA vez (como el "core" de WordPress)
     ├─ plugin: Personalizador
     ├─ plugin: Radar
     ├─ plugin: artefacto de Claude
     └─ plugin: EL PUENTE 🛎️   ← el mayordomo, es un plugin más
```

- El **cargador** es lo único que se mete dentro del Motor. Es mínimo y no rompe nada.
- A partir de ahí, **todo es plugin. Incluido el puente.** El mayordomo se enciende, se
  apaga y se actualiza como cualquier otro enchufe.

> ¿Es menos eficiente que coserlo a fuego en el núcleo? Un pelín. ¿Se nota? No. ¿Merece la
> pena por mantener el Motor limpio y todo modular? Totalmente. (Instinto WordPress: ✅)

---

## 6. La pregunta del millón: si toco MI Motor, ¿funciona para los demás?

**No automáticamente. Respuesta corta: no.**

- Los paquetes que publicamos son la **herramienta para construir** plugins. **No cambian
  el Motor de nadie** por sí solos.
- Lo que hace que un Motor pueda *ejecutar* plugins es el **cargador**, y el cargador vive
  **dentro** del Motor.
- Si lo metes **solo en tu Motor** → **solo a ti** te funcionan. Los demás, con su Motor de
  fábrica, no notan nada.

Para que funcione **para todos**, el cargador tiene que llegar a **sus** Motores. Dos caminos:

| Camino | Cómo | ¿Dependes de alguien? |
|---|---|---|
| **Oficial** | Imperio lo mete en el Motor oficial → lo reciben todos al actualizar. | Sí (Imperio). |
| **Add-on** | Lo empaquetas como "instálalo tú" (estilo el `install.sh` del Radar). | No, autoservicio. |

---

## 7. La estrategia elegida: BETA → MERGE (graduación)

Como en un software que primero va en **beta** y, si convence, se **mergea** al producto:

```
FASE 1 — BETA (opt-in)            FASE 2 — OFICIAL (si Imperio aprueba)
cargador + puente como add-on  →  Imperio lo mergea al core del Motor
cada uno lo instala si quiere     todos lo traen de serie
```

- **Es el MISMO código** en las dos fases. "Mergear" = mover el cargador dentro del Motor
  oficial. No se rehace nada.
- Empezamos por el **add-on** (no dependemos de nadie) como **beta**.
- Si convence a la comunidad, se le propone a Imperio meterlo en el core.
- **Reversible:** si no convence, ningún Motor oficial quedó tocado.

Ventaja para Imperio: les llega **ya probado** por la comunidad, no a ciegas.

---

## 8. ¿Y por qué hubo tanto lío con npm, tokens, etc.?

Eso fue solo para **dejar la caja de herramientas en una "tienda" pública**, para que la
gente la baje con un comando. Es una tarea **del autor, una sola vez**. **Quien USA los
plugins no toca ningún token ni cuenta — nunca.** (Ver glosario.)

---

## Glosario en cristiano

| Palabreja | Qué es, sin rodeos |
|---|---|
| **Plugin** | Un "enchufe" que le añades al Motor sin abrirlo por dentro. |
| **Manifiesto** | La etiqueta de un plugin: nombre, qué hace, qué permisos pide. |
| **SDK** | La caja de herramientas para fabricar plugins. |
| **MCP** | Un ayudante al que tu agente (Claude Code) le pide "créame un plugin" y lo hace. |
| **Artefacto** | Una mini-app hecha en Claude (las que comparte la gente). |
| **Shim** | El "intercomunicador" que metemos en el artefacto para que pueda pedir cosas fuera. |
| **Puente / host** | El "mayordomo" del Motor que oye al plugin y le presta Claude. |
| **Cargador** | El trocito que se mete UNA vez en el Motor para que pueda usar plugins (el "core" de WordPress). |
| **Registro / npm / npmjs.com** | La **tienda pública** donde viven los paquetes. Es una sola, la misma para todos. |
| **npm / pnpm / bun** | Tres **herramientas distintas** para entrar a esa misma tienda. (Usamos bun; pnpm solo para identificarnos.) |
| **Publicar** | Dejar tu paquete en la tienda. Lo hace el autor, una vez. |
| **Token / login** | El "carnet" para poder dejar cosas en la tienda. Solo lo necesita el autor al publicar. **El que usa, no.** |
| **2FA** | Seguridad extra (un código de un solo uso) para tu cuenta de la tienda. |
| **Repo / GitHub** | Donde vive el código fuente, a la vista. Otros pueden mirarlo y proponer mejoras, pero no cambiar el tuyo. |
| **Open source / MIT** | "Úsalo libremente, solo mantén el crédito." |

---

> ¿Te perdiste en algún punto? No pasa nada: el lío casi siempre es de **palabras**, no de
> ideas. Las ideas de aquí son sencillas. Vuelve al glosario y relee el trozo.
