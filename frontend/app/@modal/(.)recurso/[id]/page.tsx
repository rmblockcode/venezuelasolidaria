import { fetchResource } from "../../../lib/api";
import PostModal from "../../../components/PostModal";

// Intercepta la navegación dentro de la app a /recurso/[id]: muestra el post
// como modal sobre el directorio, sin recargar ni perder el estado de la home.
export default async function InterceptedRecurso({
  params,
}: {
  params: { id: string };
}) {
  const item = await fetchResource(params.id);
  return <PostModal resource={item} />;
}
