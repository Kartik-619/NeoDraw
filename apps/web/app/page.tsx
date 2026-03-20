'use client'
import { useState } from "react";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";


export default function Home() {
  const [roomId,setRoomId]=useState("");
  //it gives access to the router object allowing to navigate via urls
  const router=useRouter();


  return (
    <div className={styles.page}>
     <input value={roomId} onChange={(e)=>{
      setRoomId(e.target.value);
     }} type="text" placeholder="Room Id"/>
    
    <button onClick={()=>{
      //allows to visit the mentioned url
      router.push('/room/${roomId');
    }}>Join Room </button>
    </div>
  );
}
