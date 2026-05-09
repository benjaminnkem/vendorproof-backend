export type CloudinaryUploadResourceType = "image" | "video" | "raw" | "auto";

export type CloudinaryUploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

export type UploadFileRequest = {
  file: CloudinaryUploadFile | string;
  folder?: string;
  publicId?: string;
  resourceType?: CloudinaryUploadResourceType;
};

export type UploadFileResponse = {
  url: string;
};
