import { useState } from "react"

export default function App() {
  return (
    <div style={{background:"#0A0A0F",minHeight:"100vh",display:"flex",
      alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{fontSize:28,fontWeight:900,color:"#D4AF37",letterSpacing:4}}>
        IRON<span style={{color:"#CC1111"}}>LABS</span>
      </div>
      <div style={{fontSize:12,color:"#ffffff40",letterSpacing:3,fontFamily:"monospace"}}>
        PHARMACEUTICAL · COMMAND CENTER
      </div>
      <div style={{fontSize:11,color:"#4ade80",fontFamily:"monospace",marginTop:8}}>
        ✅ SISTEMA ONLINE
      </div>
    </div>
  )
}
