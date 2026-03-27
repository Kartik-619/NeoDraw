"use client";

import { useState } from "react";
import axios from "axios";

export function AuthPage({ isSignin }: { isSignin: boolean }) {

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [name, setName] = useState("")
    async function handleAuth() {
        const endpoint = isSignin ? "signIn" : "signup"
        const body = isSignin
            ? { email, password }
            : { email, name,password }

        const res = await axios.post(`http://localhost:3008/${endpoint}`, body);

        localStorage.setItem("token", res.data.token)
        window.location.href = "/"
    }

    return (
        <div className="w-screen h-screen flex justify-center items-center">
            <div className="p-6 m-2 bg-white rounded">

                <div className="p-2">
                    <input
                        type="text"
                        placeholder="Email"
                        className="border p-2"
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div className="p-2"><input
                    type="text"
                    placeholder="Name"
                    className="border p-2"
                    onChange={(e) => setName(e.target.value)}
                /></div>
                <div className="p-2">
                    <input
                        type="password"
                        placeholder="Password"
                        className="border p-2"
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div className="pt-2">
                    <button
                        className="bg-red-200 rounded p-2"
                        onClick={handleAuth}
                    >
                        {isSignin ? "Sign in" : "Sign up"}
                    </button>
                </div>

            </div>
        </div>
    )
}