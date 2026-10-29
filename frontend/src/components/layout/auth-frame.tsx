import type { ReactNode } from 'react';
import { StatusIcon, TypeIcon } from '@/components/ui/glyphs';

/** Two-column frame for sign-in pages: brand panel and the form. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-app">
      <aside className="relative m-3 hidden w-[min(600px,42vw)] shrink-0 flex-col overflow-hidden rounded-[18px] bg-[#111218] p-10 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(600px_380px_at_85%_0%,rgba(99,102,241,.55),transparent_60%),radial-gradient(500px_360px_at_0%_100%,rgba(13,148,136,.35),transparent_60%)]" />
        <div className="relative flex items-center gap-2.5">
          <span className="flex size-[30px] items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-bold">Z</span>
          <span className="text-[14px] font-semibold">Zeno TeamSuite</span>
        </div>
        <div className="relative mt-auto flex flex-col gap-4">
          <h2 className="text-[40px] font-semibold leading-[1.08] tracking-[-0.035em]">
            Plan, build and ship
            <br />
            <span className="text-indigo-300">together.</span>
          </h2>
          <p className="max-w-[420px] text-[14px] leading-relaxed text-[#c9cbd6]">
            One workspace for your projects, sprints, quality and code — so every next step is clear.
          </p>
          <div aria-hidden className="mt-4 w-[440px] max-w-full rounded-xl border border-white/10 bg-white/5 p-3.5">
            <div className="mb-2.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-[#c9cbd6]">Sprint review</span>
              <span className="text-green-300">● Active</span>
            </div>
            {(
              [
                ['Leave request form', 'DONE'],
                ['Approval workflow', 'IN_PROGRESS'],
                ['Balance validation', 'TESTING'],
              ] as const
            ).map(([t, s]) => (
              <div key={t} className="flex h-[34px] items-center gap-2.5 border-t border-white/10">
                <TypeIcon type="STORY" size={15} />
                <span className="flex-1 text-[13px] text-[#e6e7ee]">{t}</span>
                <StatusIcon status={s} />
              </div>
            ))}
          </div>
        </div>
        <span className="relative mt-7 text-xs text-[#6e7280]">© {new Date().getFullYear()} Zeno TeamSuite</span>
      </aside>
      <main className="flex flex-1 items-center justify-center p-6">{children}</main>
    </div>
  );
}
