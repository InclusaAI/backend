declare class SlideDto {
    order: number;
    url: string;
}
export declare class CreatePresentationDto {
    name: string;
    slideMetadata: SlideDto[];
    organizationId: string;
}
export {};
