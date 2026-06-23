import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LeadForm, getForms, seedIfEmpty } from "@/lib/leadGen";
import FormRenderer from "./FormRenderer";

export default function PublicForm() {
  const { formId } = useParams();
  const [form, setForm] = useState<LeadForm | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    seedIfEmpty();
    const f = getForms().find(x => x.id === formId);
    if (!f) setMissing(true); else setForm(f);
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.remove("dark");
    return () => { if (hadDark) root.classList.add("dark"); };
  }, [formId]);

  if (missing) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8]"><div className="text-center"><h1 className="text-2xl font-bold text-[#0A1628]">Form not found</h1><p className="text-gray-500 mt-2">This form is unavailable.</p></div></div>;
  }
  if (!form) return null;

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex flex-col">
      <div className="py-6 text-center">
        <span className="text-2xl font-bold text-[#0A1628]">B2BNEST</span>
      </div>
      <div className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <FormRenderer form={form} />
        </div>
      </div>
    </div>
  );
}
