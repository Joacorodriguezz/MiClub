# 08 — Descubrimiento: cómo hablar con un club

Guía para las primeras conversaciones con clubes candidatos. Cierra la decisión **D3**
y alimenta las reglas de negocio pendientes del final del [doc 02](02-glosario-y-dominio.md).

## El objetivo de la primera charla NO es vender

Es entender cómo cobran hoy. Si vendés, te dicen que sí por educación y te quedás
sin información. Si entendés, te llevás las reglas que necesitás para construir.

**Regla de oro: no muestres el producto hasta el final.** En cuanto ven una pantalla,
dejan de contarte su proceso y empiezan a opinar sobre la pantalla. La información
valiosa se pierde.

## A quién hablarle

| Persona | Sirve para | Cuidado |
|---|---|---|
| **Tesorero / quien cobra** | ⭐ Es *el* usuario. Tiene el dolor y conoce todas las reglas raras | A veces no tiene poder de decisión |
| Presidente / comisión directiva | Aprueba el gasto | Te va a contar el club ideal, no el proceso real |
| Secretario / administrativo | Mantiene el padrón | Puede ser la misma persona que el tesorero |

Si solo podés hablar con uno, que sea **el que cobra**. Si te presentan al presidente,
pedile que te conecte con el tesorero: *"me gustaría ver cómo se hace hoy en la práctica"*.

## Guion de entrevista (40–50 min)

Preguntas abiertas y en orden cronológico. Dejalo hablar; las mejores respuestas
aparecen en las digresiones.

### Bloque 1 — Contexto (5 min)

1. ¿Cuántos socios tienen hoy? ¿Cuántos activos de verdad?
2. ¿Qué categorías de socio manejan? (activo, cadete, vitalicio, adherente…)
3. ¿Cuánto sale la cuota hoy? ¿Cada cuánto la actualizan?

### Bloque 2 — El proceso real (20 min) ⭐ el bloque que importa

4. **"Contame cómo cobraste la cuota de este mes, paso a paso, desde que arrancó el mes."**
   Esta es la pregunta más productiva de todas. No la interrumpas.
5. ¿Dónde está el padrón hoy? ¿Quién lo mantiene? ¿Hay más de una copia dando vueltas?
6. ¿Cómo le avisan al socio que tiene que pagar?
7. ¿Cómo paga el socio? Pedí porcentajes aproximados: efectivo / transferencia /
   Mercado Pago / débito.
8. Cuando entra una transferencia, ¿cómo sabés de quién es?
9. ¿Cuánto tiempo por mes te lleva todo esto?

### Bloque 3 — Morosidad (10 min)

10. ¿Cuánta gente está debiendo hoy? **¿Sabés el número exacto?**
    → Si duda o dice "y… bastante", ahí está el dolor. Anotá la frase textual.
11. ¿Desde cuándo debe el que más debe?
12. ¿Qué hacés con un moroso? ¿Hay alguna consecuencia real?
13. ¿Alguna vez le cortaron el acceso a alguien por deuda? ¿Cómo lo controlan?

### Bloque 4 — Las reglas raras (10 min)

Estas son exactamente las incógnitas del doc 02. Preguntalas de a una:

14. Si una familia tiene tres hijos socios, ¿cómo se le cobra? ¿Un pago o tres?
15. Si alguien se asocia el día 20, ¿paga el mes completo, una parte, o nada?
16. ¿Cobran recargo si pagan tarde? ¿Cómo se calcula?
17. ¿Hacen descuento por pagar el año adelantado o varios meses juntos?
18. Los vitalicios y jubilados, ¿pagan? ¿Cuánto?
19. ¿Se cobra algo al asociarse por primera vez? (matrícula)
20. Si un socio se va tres meses de viaje, ¿se le sigue cobrando?
21. ¿Alguna vez cobraron una cuota extraordinaria? ¿Para qué?

### Bloque 5 — Viabilidad (5 min)

22. ¿Probaron algún sistema antes? **¿Por qué lo dejaron?** ⭐ oro puro: te dice
    exactamente contra qué vas a competir y qué falló.
23. ¿El club tiene cuenta de Mercado Pago? ¿A nombre del club o de una persona?
    → Crítico: D1 quedó decidido como "la plata cae en la cuenta del club".
    Si el club no tiene cuenta o está a nombre del tesorero, tenés un problema de
    onboarding que hay que diseñar.
24. ¿Le dan factura o recibo al socio? ¿Alguien se lo pide? (alimenta D9)
25. ¿Quién decide una compra así? ¿Cuánto les parecería razonable pagar por mes?

## Qué pedirles que te manden

Vale más que toda la entrevista. Pedilo **antes de cortar**, mientras hay entusiasmo:

- [ ] **El Excel del padrón tal cual está**, con toda su suciedad. No pidas que lo
      limpien: la suciedad es el requisito del importador.
- [ ] Captura del mensaje de WhatsApp que le mandan al socio.
- [ ] El recibo o comprobante que entregan hoy, si existe.
- [ ] El estatuto o reglamento, si lo tienen a mano: las categorías de socio y las
      exenciones suelen estar ahí, escritas y aprobadas.

> Si te dicen "te lo mando" y nunca llega, es información también: mide cuánto les
> importa realmente. Un club que en dos días no te manda un Excel no va a migrar su
> padrón en tres meses.

## Cómo leer al candidato

**Buen club de diseño**
- El tesorero contesta rápido y quiere resolverlo; ya intentó algo antes.
- Sabe que tiene morosidad y le molesta. Mejor si te da un número.
- Entre 200 y 1500 socios: chico duele poco, grande tiene otros problemas.
- El club tiene (o puede abrir) cuenta de Mercado Pago propia.
- Te deja ver el Excel sin pedir permiso a nadie.

**Mal fit — no te enamores**
- "Mandame el sistema y lo pruebo": no quiere hablar, quiere software gratis.
- Quien te habla no es quien cobra.
- Pide 20 features antes de usar nada: está diseñando, no comprando.
- No tienen problema de morosidad, o la cuota es simbólica: **no hay dolor, no hay producto.**
- La cuenta de cobro está a nombre personal de alguien y no piensan cambiarlo.

## Errores a evitar

| Error | Por qué arruina la entrevista |
|---|---|
| Mostrar el producto al principio | Dejan de contarte su proceso y empiezan a criticar la UI |
| Preguntar "¿usarías esto?" | Todos dicen que sí. Preguntá **"¿cómo lo hacés hoy?"** |
| Tomar "estaría bueno que tenga X" como requisito | Los deseos no son necesidades. Solo cuenta lo que ya hacen o ya sufren |
| Explicar por qué su proceso está mal | Se cierran. Sos un observador, no un consultor |
| Hablar de precio antes de entender el valor | Te anclan bajo y no podés volver |
| Entrevistar a un solo club | Construís un traje a medida disfrazado de SaaS |

## Registro de hallazgos

Una fila por club. Cuando dos clubes coinciden, es una regla del producto; cuando
difieren, es configuración.

| Regla | Club A | Club B | Club C | ¿Común o config? |
|---|---|---|---|---|
| Cantidad de socios | | | | — |
| Categorías | | | | |
| Prorrateo en el alta | | | | |
| Día de vencimiento | | | | |
| Recargo por mora | | | | |
| Descuento por adelantado | | | | |
| Cuota familiar | | | | |
| Exenciones (vitalicio/jubilado) | | | | |
| Matrícula de ingreso | | | | |
| Suspensión temporal | | | | |
| Corte de acceso por deuda | | | | |
| % que paga en efectivo | | | | — |
| Tiene cuenta MP propia | | | | — |
| Sistema anterior y por qué falló | | | | — |
| Precio que aceptaría | | | | — |

## Meta de esta etapa

**Tres clubes entrevistados y al menos dos Excel reales en la mano.**
Con eso, D3 se cierra, las reglas del doc 02 dejan de ser suposiciones, y el
importador CSV se diseña contra datos verdaderos en vez de imaginados.
