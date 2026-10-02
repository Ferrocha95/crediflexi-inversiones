"use client";

import { RefreshCw } from "lucide-react";
import { useId, useState } from "react";
import { Boton } from "../../componentes/ui/Boton";
import { AreaTexto, Campo, Entrada } from "../../componentes/ui/Campo";
import { Casilla } from "../../componentes/ui/Casilla";
import { Dialogo } from "../../componentes/ui/Dialogo";
import { useNotificar } from "../../componentes/ui/Notificaciones";
import { Opciones } from "../../componentes/ui/Opciones";
import { Pestanas } from "../../componentes/ui/Pestanas";
import { Selector } from "../../componentes/ui/Selector";
import { TarjetaTotal } from "../../componentes/vistas/TarjetaTotal";
import { CIFRAS_EJEMPLO } from "./datosEjemplo";

/** Botón que recorre las cifras de ejemplo para ver rodar el número animado. */
export function DemoNumero() {
  const [i, setI] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <TarjetaTotal etiqueta="Total de ejemplo" valor={CIFRAS_EJEMPLO[i]}>
        Cambia la cifra para ver cómo ruedan los dígitos. Con movimiento reducido, el cambio es inmediato.
      </TarjetaTotal>
      <Boton
        variante="secundario"
        icono={<RefreshCw aria-hidden="true" className="size-5" />}
        onClick={() => setI((x) => (x + 1) % CIFRAS_EJEMPLO.length)}
        className="self-start"
      >
        Cambiar la cifra
      </Boton>
    </div>
  );
}

export function DemoControles() {
  const id = useId();
  const [esquema, setEsquema] = useState<"mensual" | "vencimiento">("mensual");
  const [nota, setNota] = useState("");
  const [acepto, setAcepto] = useState(false);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Campo id={`${id}-nombre`} etiqueta="Nombre del prospecto" ayuda="Solo nombre y apellido.">
        <Entrada id={`${id}-nombre`} aria-describedby={`${id}-nombre-ayuda`} defaultValue="Prospecto Ejemplo Uno" />
      </Campo>
      <Campo id={`${id}-tel`} etiqueta="Teléfono" error="Escribe los 10 dígitos, por ejemplo 55 0000 0001.">
        <Entrada id={`${id}-tel`} aria-invalid="true" aria-describedby={`${id}-tel-error`} inputMode="tel" defaultValue="55 0000" />
      </Campo>
      <Campo id={`${id}-estatus`} etiqueta="Estatus">
        <Selector id={`${id}-estatus`} defaultValue="INTERESADO">
          <option value="INTERESADO">INTERESADO</option>
          <option value="INTERMITENTE">INTERMITENTE</option>
          <option value="NO INTERESADO">NO INTERESADO</option>
        </Selector>
      </Campo>
      <Opciones
        nombre={`${id}-esquema`}
        leyenda="Esquema"
        valor={esquema}
        alCambiar={setEsquema}
        opciones={[
          { valor: "mensual", etiqueta: "Pago mensual" },
          { valor: "vencimiento", etiqueta: "Al vencimiento" },
        ]}
      />
      <Campo
        id={`${id}-nota`}
        etiqueta="Comentarios"
        contador={`${Array.from(nota).length} de 200 caracteres`}
        className="md:col-span-2"
      >
        <AreaTexto
          id={`${id}-nota`}
          rows={3}
          maxLength={200}
          value={nota}
          aria-describedby={`${id}-nota-contador`}
          onChange={(e) => setNota(e.target.value)}
        />
      </Campo>
      <Casilla etiqueta="Confirmo que los datos son de ejemplo" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
      <Entrada aria-label="Campo deshabilitado de ejemplo" disabled defaultValue="Campo deshabilitado" />
    </div>
  );
}

export function DemoBotones() {
  return (
    <div className="flex flex-wrap gap-3">
      <Boton>Guardar cambios</Boton>
      <Boton variante="secundario">Cancelar</Boton>
      <Boton variante="fantasma">Ver detalle</Boton>
      <Boton cargando>Generando</Boton>
      <Boton disabled>Deshabilitado</Boton>
    </div>
  );
}

export function DemoPestanas() {
  return (
    <Pestanas
      etiqueta="Vistas de ejemplo"
      pestanas={[
        { clave: "semana", etiqueta: "Esta semana", contenido: <p className="text-hielo">Contenido de la pestaña «Esta semana».</p> },
        { clave: "siguiente", etiqueta: "Siguiente semana", contenido: <p className="text-hielo">Contenido de la pestaña «Siguiente semana».</p> },
        { clave: "mes", etiqueta: "Mes", contenido: <p className="text-hielo">Contenido de la pestaña «Mes».</p> },
      ]}
    />
  );
}

export function DemoDialogoYNotificaciones() {
  const [abierto, setAbierto] = useState(false);
  const notificar = useNotificar();
  return (
    <div className="flex flex-wrap gap-3">
      <Boton variante="secundario" onClick={() => setAbierto(true)}>
        Abrir el diálogo
      </Boton>
      <Boton variante="secundario" onClick={() => notificar({ tono: "exito", titulo: "Cambios guardados", texto: "Notificación de ejemplo." })}>
        Notificar éxito
      </Boton>
      <Boton
        variante="secundario"
        onClick={() =>
          notificar({ tono: "error", titulo: "No se pudo guardar", texto: "Revisa tu conexión y vuelve a intentarlo. (Ejemplo)" })
        }
      >
        Notificar error
      </Boton>
      <Dialogo
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo="Descartar los cambios"
        acciones={
          <>
            <Boton variante="fantasma" onClick={() => setAbierto(false)}>
              Seguir editando
            </Boton>
            <Boton onClick={() => setAbierto(false)}>Descartar</Boton>
          </>
        }
      >
        Diálogo de ejemplo. Se cierra con Esc, con el botón de cerrar o con un clic fuera de la caja, y el foco vuelve al botón que lo abrió.
      </Dialogo>
    </div>
  );
}
