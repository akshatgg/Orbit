import Link from "next/link";
import { OrganiserLogo } from "@/components/organiser/OrganiserStatus";
import { VerifiedMark } from "@/components/ui/Badge";
import type { GroupOrganiser } from "@/types/social";

/**
 * "by {organisation}" with its logo and verified mark, for a community an organisation runs.
 * Links to the organisation's page unless `plain` (inside a card that is itself a link).
 */
export function OrganiserByline({ organiser, plain = false, className = "" }: { organiser: GroupOrganiser; plain?: boolean; className?: string }) {
  const body = (
    <>
      <OrganiserLogo src={organiser.logo_url} name={organiser.name} size={18} className="rounded-md" />
      <span className="min-w-0 truncate">
        by <span className="font-medium text-fg/90">{organiser.name}</span>
      </span>
      {organiser.is_verified && <VerifiedMark className="shrink-0" />}
    </>
  );
  const style = `inline-flex max-w-full items-center gap-1.5 text-xs text-muted ${className}`;
  if (plain) return <span className={style}>{body}</span>;
  return (
    <Link href={`/o/${organiser.slug}`} className={`${style} rounded-md transition-colors hover:text-fg`}>
      {body}
    </Link>
  );
}
