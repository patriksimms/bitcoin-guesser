import { useEffect } from "react";
import { toast } from "sonner";

export default function useErrorNotification({
    isError,
    title,
    description,
  }: {isError: boolean, title: string, description: string, status?: string}) {
  
    useEffect(() => {
      if (isError) {
        toast.error(title, {description});
      }
    }, [isError, description, title]);
  }
