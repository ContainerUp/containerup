export function getImageNameFromInspection(img) {
    if (!img) {
        return '';
    }

    if (img.RepoTags) {
        return img.RepoTags[0];
    }

    return img.Id.substring(0, 12);
}
