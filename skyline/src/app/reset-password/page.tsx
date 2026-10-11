import { AuthScreen } from "@/components/club/auth-screen";
export default async function Page({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  return <AuthScreen mode="reset" token={searchParams.token} />;
}
