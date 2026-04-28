import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-black group-[.toaster]:border-4 group-[.toaster]:border-black group-[.toaster]:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group-[.toaster]:rounded-none",
          title: "font-bebas tracking-widest uppercase text-lg",
          description: "font-source-sans font-black text-[10px] uppercase tracking-tighter text-black/60",
          actionButton: "group-[.toast]:bg-black group-[.toast]:text-[#FFD200] group-[.toast]:rounded-none group-[.toast]:font-bebas",
          cancelButton: "group-[.toast]:bg-zinc-200 group-[.toast]:text-black group-[.toast]:rounded-none group-[.toast]:font-bebas",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
