"use client";
import {FormEvent, useState} from "react";
import {Button} from "@/components/ui/button";
import {login} from "@/lib/actions/login";
import {AuthError} from "@supabase/auth-js";
import {toast} from "sonner";
import {LoginForm} from "@/components/ui/login-form";
import {useRouter} from "next/navigation";

export default function Page() {
  const [loading, setLoading] = useState(false);
  const router = useRouter()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    try {
      await login(formData);
    } catch (error) {
      toast.error((error as AuthError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col w-full max-w-md	py-24 mx-auto">
      <h1 className="text-3xl font-bold text-center">{"Welcome back"}</h1>
      <LoginForm loading={loading} onSubmit={handleSubmit} />
      <div className="flex flex-row space-x-2 items-center justify-center mt-2">
        <span className="text-sm">{"Don't have an account?"}</span>
        <Button
          className="p-0 text-blue-700 dark:text-blue-400 text-sm"
          variant="link"
          onClick={() => router.push('/signup')}
        >
          {"Sign Up"}
        </Button>
      </div>
    </div>
  )
}
