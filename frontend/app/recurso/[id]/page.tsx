import type { Metadata } from "next";
import { fetchResource } from "../../lib/api";
import { CATS } from "../../lib/constants";
import Directory from "../../components/Directory";
import PostModal from "../../components/PostModal";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const item = await fetchResource(params.id);
  if (!item) {
    return { title: "Publicación no disponible · Venezuela Solidaria" };
  }
  const cat = CATS[item.category]?.label ?? "";
  const title = `${item.title} · Venezuela Solidaria`;
  const description = item.desc || `${cat} en el directorio de ayuda Venezuela Solidaria.`;
  const url = `/recurso/${item.id}`;
  return {
    title,
    description,
    openGraph: {
      title: item.title,
      description,
      url,
      type: "article",
      images: item.image ? [{ url: item.image }] : undefined,
    },
    twitter: {
      card: item.image ? "summary_large_image" : "summary",
      title: item.title,
      description,
      images: item.image ? [item.image] : undefined,
    },
  };
}

export default async function RecursoPage({ params }: { params: { id: string } }) {
  const item = await fetchResource(params.id);
  // Enlace abierto en frío (p. ej. desde redes): mostramos el directorio
  // completo detrás y el post en un modal encima, igual que dentro de la app.
  return (
    <>
      <Directory />
      <PostModal resource={item} />
    </>
  );
}
