import { supabase } from "@/integrations/supabase/client";

/**
 * Uploads a file to a Supabase storage bucket
 * @param file The file to upload
 * @param bucket The bucket name (default: 'avatars')
 * @returns The public URL of the uploaded file
 */
export async function uploadFile(file: File, bucket: string = "avatars"): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = fileName;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return data.publicUrl;
}
