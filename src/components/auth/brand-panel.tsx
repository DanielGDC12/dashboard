import { Logo } from "./logo";

/** Left column of "01 · Login + MFA" (560 px, verde Mantiqueira). */
export function BrandPanel() {
  return (
    <aside className="relative flex shrink-0 flex-col items-center bg-verde px-8 pb-8 pt-10 text-center text-white lg:min-h-screen lg:w-[560px] lg:px-[76px] lg:pt-[119px]">
      <Logo className="h-9 w-auto text-white lg:h-[52px]" />

      <div className="mt-8 hidden flex-1 flex-col items-center lg:mt-[118px] lg:flex">
        <p className="text-[12px] font-bold uppercase tracking-[0.6px] text-limao">
          Painel de Entregas
        </p>
        <h2 className="mt-4 text-[32px] font-bold leading-[1.3] tracking-[-0.3px]">
          Onde e quando os ovos chegam, em um só lugar.
        </h2>
        <p className="mt-5 text-[15px] leading-[1.65] text-white/80">
          Edite as áreas de entrega, veja o impacto nos assinantes e publique na loja
          com segurança.
        </p>
      </div>

      <p className="mt-4 flex items-center gap-2.5 text-[13px] text-white/80 lg:mt-auto lg:pb-[30px]">
        <span aria-hidden className="size-2 rounded-full bg-limao" />
        Acesso restrito à equipe Mantiqueira
      </p>
    </aside>
  );
}
