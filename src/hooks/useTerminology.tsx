import { useAuth } from "./useAuth";

export function useTerminology() {
  const { currentInstitution } = useAuth();
  
  // Default term is "Unit"
  const term = currentInstitution?.organization_term || "Unit";
  
  return {
    term,
    termLower: term.toLowerCase(),
    // Helper untuk teks umum
    kepalaTerm: `Kepala ${term}`,
  };
}
