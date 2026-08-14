import type { Metadata, Viewport } from "next";import "./globals.css";import { RegisterSW } from "@/components/register-sw";
export const metadata:Metadata={title:"Gasto Listo",description:"Gastos y compras, sin vueltas",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,statusBarStyle:"default",title:"Gasto Listo"}};
export const viewport:Viewport={themeColor:[{media:"(prefers-color-scheme: light)",color:"#176b46"},{media:"(prefers-color-scheme: dark)",color:"#050806"}],width:"device-width",initialScale:1,viewportFit:"cover"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body><RegisterSW/>{children}</body></html>}
