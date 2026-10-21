import { describe, expect, it } from "vitest";
import { cloudinaryUrl, signParams, orbitImagePublicId } from "./cloudinary";

describe("signParams", () => {
  it("matches Cloudinary's documented example", () => {
    const sig = signParams(
      { timestamp: 1315060510, public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" },
      "abcd",
    );
    expect(sig).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });

  it("ignores file, api_key, resource_type and empty values, and is order independent", () => {
    const a = signParams({ timestamp: 1, folder: "f" }, "s");
    const b = signParams({ folder: "f", api_key: "k", file: "x", resource_type: "image", public_id: "", timestamp: 1 }, "s");
    expect(b).toBe(a);
  });
});

describe("cloudinaryUrl", () => {
  const base = "https://res.cloudinary.com/demo/image/upload/v123/orbit/event-covers/u/a.png";
  it("inserts transformations after /upload/", () => {
    expect(cloudinaryUrl(base, { width: 800 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_800,dpr_auto/v123/orbit/event-covers/u/a.png",
    );
  });
  it("supports height and crop", () => {
    expect(cloudinaryUrl(base, { width: 80, height: 80, crop: "thumb" })).toContain("c_thumb,w_80,h_80,dpr_auto/");
  });
  it("leaves other URLs unchanged", () => {
    const u = "https://abc.supabase.co/storage/v1/object/public/event-covers/u/a.png";
    expect(cloudinaryUrl(u, { width: 800 })).toBe(u);
  });
});

describe("orbitImagePublicId", () => {
  const cloud = "deor01if5";
  it("reads ORBIT's own images, with or without a version or transformations", () => {
    expect(orbitImagePublicId("https://res.cloudinary.com/deor01if5/image/upload/v1792594780/orbit/event-covers/sources/qoeitvag0a4hzhcqeg5g.jpg", cloud))
      .toBe("orbit/event-covers/sources/qoeitvag0a4hzhcqeg5g");
    expect(orbitImagePublicId("https://res.cloudinary.com/deor01if5/image/upload/f_auto,q_auto,c_fill,w_800,dpr_auto/v1/orbit/event-covers/u1/abc.png", cloud))
      .toBe("orbit/event-covers/u1/abc");
  });
  it("ignores anything ORBIT didn't store itself", () => {
    expect(orbitImagePublicId("https://res.cloudinary.com/other/image/upload/v1/orbit/event-covers/x.jpg", cloud)).toBeNull();
    expect(orbitImagePublicId("https://res.cloudinary.com/deor01if5/image/upload/v1/samples/beach.jpg", cloud)).toBeNull();
    expect(orbitImagePublicId("https://secure.meetupstatic.com/photos/event/d/e/5/6/highres_1.jpeg", cloud)).toBeNull();
    expect(orbitImagePublicId("https://abc.supabase.co/storage/v1/object/public/event-covers/u/x.jpg", cloud)).toBeNull();
    expect(orbitImagePublicId(null, cloud)).toBeNull();
  });
});
