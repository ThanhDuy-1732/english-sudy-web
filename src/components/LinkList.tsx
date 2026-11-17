import Link from "next/link";
import type { ReactNode } from "react";

export interface LinkListItem {
  href: string;
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
}

/** A titled list of destinations (exam parts, speaking scenarios, writing tasks): one bordered card, rows divided by rules. */
export default function LinkList({ title, description, items }: { title?: string; description?: string; items: LinkListItem[] }) {
  return (
    <section className="mt-8 first:mt-0">
      {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <ul className={`${title ? "mt-3" : ""} divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-card`}>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="group flex min-h-14 items-center gap-4 px-4 py-3 transition-colors hover:bg-primary-soft/60 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{item.title}</p>
                {item.meta && <p className="mt-0.5 text-sm text-muted">{item.meta}</p>}
              </div>
              {item.aside && <div className="shrink-0 text-sm text-muted">{item.aside}</div>}
              <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
