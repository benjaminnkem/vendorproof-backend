import { UploadApiOptions, v2 as cloudinary } from "cloudinary";
import cloudinaryClient from "./http-client";
import { UploadFileRequest, UploadFileResponse } from "./types";

interface CloudinaryHttpService {
  readonly client: typeof cloudinary;

  uploadFile(body: UploadFileRequest): Promise<UploadFileResponse>;
}

class CloudinaryHttpServiceImpl implements CloudinaryHttpService {
  public readonly client: typeof cloudinary;

  constructor() {
    this.client = cloudinaryClient;
  }

  async uploadFile(body: UploadFileRequest): Promise<UploadFileResponse> {
    const options: UploadApiOptions = {
      resource_type: body.resourceType ?? "auto",
      use_filename: !body.publicId,
      unique_filename: !body.publicId,
      overwrite: false,
    };

    if (body.folder) {
      options.folder = body.folder;
    }

    if (body.publicId) {
      options.public_id = body.publicId;
    }

    const result =
      typeof body.file === "string"
        ? await this.client.uploader.upload(body.file, options)
        : await this.client.uploader.upload(
            this.toDataUri(body.file.buffer, body.file.mimetype),
            options,
          );

    return {
      url: result.secure_url,
    };
  }

  private toDataUri(buffer: Buffer, mimetype: string): string {
    return `data:${mimetype};base64,${buffer.toString("base64")}`;
  }
}

const cloudinaryHttpService: CloudinaryHttpService =
  new CloudinaryHttpServiceImpl();

export default cloudinaryHttpService;
export type { CloudinaryHttpService };
