import { PainelHeader } from "@/components/painel/header";
import { Sidebar } from "@/components/painel/sidebar";

export default function PainelLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* TODO: passar `pending` quando existir a versão em rascunho (fluxo de publicações). */}
      <PainelHeader />
      <div className="mx-auto flex w-full max-w-[1366px] flex-1 flex-col lg:flex-row">
        <Sidebar />
        {/* Área de conteúdo (ct): começa em x = 232, com 24 px de respiro. */}
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </>
  );
}
