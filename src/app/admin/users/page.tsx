import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

// Built by the "admin" feature.
export default function Page() {
  return (
    <>
      <PageHeader title="Users &amp; admins" subtitle="People on ORBIT" />
      <Placeholder>Users list; super admin adds/removes admins.</Placeholder>
    </>
  );
}
