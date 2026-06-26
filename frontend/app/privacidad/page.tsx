import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad · Venezuela Solidaria",
  description:
    "Cómo cuidamos tus datos en Venezuela Solidaria, un directorio comunitario sin fines de lucro para la ayuda humanitaria tras los sismos.",
};

export default function PrivacidadPage() {
  return (
    <div data-theme="esperanza">
      <div className="flagbar">
        <div style={{ background: "#f6c945" }} />
        <div style={{ background: "#1f6fb0" }} />
        <div style={{ background: "#cf3a2e" }} />
      </div>

      <header className="legal-head wrap">
        <div className="brand">
          <div className="ticks">
            <span style={{ background: "#f6c945" }} />
            <span style={{ background: "#1f6fb0" }} />
            <span style={{ background: "#cf3a2e" }} />
          </div>
          <div className="names">
            <span className="n1">Venezuela Solidaria</span>
            <span className="n2">Directorio de ayuda · Sismos 2026</span>
          </div>
        </div>
        <Link href="/" className="legal-back">
          ← Volver al directorio
        </Link>
      </header>

      <article className="legal wrap">
        <h1>Política de privacidad</h1>
        <p className="legal-lead">
          Venezuela Solidaria es un directorio comunitario, <strong>sin fines de lucro</strong>,
          creado para centralizar y facilitar la <strong>ayuda humanitaria</strong> tras los sismos
          en Venezuela. Cuidar tu información y tu confianza es parte esencial de esa misión. Aquí te
          explicamos, en lenguaje claro, qué datos tratamos y cómo los protegemos.
        </p>

        <h2>1. Quiénes somos y para qué existe esto</h2>
        <p>
          Somos un equipo de voluntarios. No vendemos productos ni servicios, no mostramos publicidad
          y no perseguimos ningún fin comercial. El único propósito de este sitio es ayudar a que las
          personas encuentren recaudaciones, contactos de emergencia, páginas de la comunidad y
          jornadas solidarias verificadas.
        </p>

        <h2>2. Qué información recopilamos</h2>
        <ul>
          <li>
            <strong>Lo que envías al agregar un recurso:</strong> título, enlace o teléfono,
            descripción, ubicación (ciudad/país), fechas, una imagen opcional y, si quieres, un
            <strong> contacto opcional</strong> (correo o teléfono) para que podamos verificar el
            envío.
          </li>
          <li>
            <strong>Preferencias del navegador:</strong> guardamos en tu propio dispositivo el tema
            visual que elijas. No es información personal ni sale de tu navegador.
          </li>
        </ul>
        <p>
          No te pedimos crear una cuenta, ni recopilamos datos sensibles. Por favor, no incluyas
          información personal de terceros sin su consentimiento.
        </p>

        <h2>3. Para qué usamos tu información</h2>
        <p>
          Usamos lo que envías únicamente para construir y mantener el directorio. El{" "}
          <strong>contacto que dejas se usa solo para confirmar que el recurso es real</strong>; no
          se publica, no se muestra a otros usuarios y no se utiliza para enviarte publicidad.
        </p>

        <h2>4. Verificación y moderación</h2>
        <p>
          Cada envío se revisa antes de publicarse. Confirmamos que el enlace funcione, que la
          iniciativa sea legítima y que no esté duplicada. El acceso de moderación está restringido y
          protegido con credenciales.
        </p>

        <h2>5. Con quién se comparte</h2>
        <p>
          <strong>No vendemos ni compartimos tus datos personales.</strong> La información de los
          recursos que se publica es pública por naturaleza (tú decides qué enviar para que la
          comunidad la vea). Para que el sitio funcione usamos algunos servicios de terceros, que
          reciben solo lo estrictamente necesario:
        </p>
        <ul>
          <li>
            <strong>OpenStreetMap</strong> (mapa, geocodificación y autocompletado de ubicaciones):
            recibe el texto de ciudad/país que se busca.
          </li>
          <li>
            <strong>Cloudinary</strong> (almacenamiento de imágenes): aloja las fotos que se suben.
          </li>
        </ul>

        <h2>6. Cómo protegemos tus datos</h2>
        <p>
          El sitio funciona sobre <strong>conexión cifrada (HTTPS)</strong>. La información se guarda
          en una base de datos protegida, el acceso administrativo es limitado y las contraseñas se
          almacenan cifradas. Aun así, ningún sistema es 100% infalible; trabajamos para minimizar
          cualquier riesgo.
        </p>

        <h2>7. Cookies y rastreo</h2>
        <p>
          No usamos cookies de publicidad ni herramientas de rastreo de terceros. Solo empleamos el
          almacenamiento local de tu navegador para recordar tu preferencia de tema y, en el caso del
          equipo, mantener la sesión de moderación.
        </p>

        <h2>8. Tus derechos</h2>
        <p>
          Puedes pedir que corrijamos o eliminemos un recurso, o el contacto que hayas dejado,
          escribiéndonos. Atenderemos tu solicitud lo antes posible.
        </p>

        <h2>9. Aviso importante</h2>
        <p>
          Este es un directorio comunitario de demostración y ayuda. Algunos enlaces pueden ser de
          ejemplo. <strong>Verifica siempre antes de donar</strong> o compartir datos sensibles. La
          marca ✓ indica que el equipo revisó el recurso, pero la responsabilidad final de cada
          donación es tuya.
        </p>

        <h2>10. Contacto</h2>
        <p>
          Para cualquier consulta sobre privacidad o para solicitar cambios, escríbenos a{" "}
          <a href="mailto:info@betternfaster.com">info@betternfaster.com</a>.
        </p>

        <p className="legal-updated">Última actualización: junio de 2026.</p>

        <Link href="/" className="legal-back-btn">
          ← Volver al directorio
        </Link>
      </article>
    </div>
  );
}
