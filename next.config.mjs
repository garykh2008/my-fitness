/** @type {import('next').NextConfig} */
const nextConfig = {
  // 產出獨立可執行的最小化 server（Docker 部署用）
  output: "standalone",
};

export default nextConfig;
