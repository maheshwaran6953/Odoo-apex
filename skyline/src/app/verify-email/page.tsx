import { AuthScreen } from "@/components/club/auth-screen";
export default function Page({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  return <AuthScreen mode="verify" token={searchParams.token} />;
}
