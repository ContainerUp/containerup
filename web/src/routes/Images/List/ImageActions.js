import {Tooltip} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import {green, orange} from "@mui/material/colors";
import {Link as RouterLink} from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import {useCallback, useState} from "react";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ImageDialogRemove from "./ImageDialogRemove";
import ImageDialogTag from "./ImageDialogTag";

export default function ImageActions({image}) {
    const [dialogDel, setDialogDel] = useState(false);
    const [dialogTag, setDialogTag] = useState(false);

    const createContainerParam = new URLSearchParams();
    createContainerParam.set('image', image.nameOrId);

    const canRemove = image.Containers === 0 || (image.RepoTags && image.RepoTags.length > 1);

    const handleDialogClose = useCallback(() => {
        setDialogTag(false);
    }, []);

    return (
        <>
            <ImageDialogRemove
                open={dialogDel}
                image={image}
                onClose={() => setDialogDel(false)}
            />
            <ImageDialogTag
                open={dialogTag}
                imageIdShort={image.idShort}
                onClose={handleDialogClose}
            />

            <Tooltip title="Create a container using this image">
                <IconButton
                    aria-label="create a container using this image"
                    color="primary"
                    component={RouterLink}
                    to={'/containers_create?' + createContainerParam.toString()}
                >
                    <AddCircleIcon />
                </IconButton>
            </Tooltip>

            <Tooltip title="Add a tag">
                <IconButton
                    aria-label="add a tag"
                    sx={{color: green[500]}}
                    onClick={() => setDialogTag(true)}
                >
                    <LocalOfferIcon />
                </IconButton>
            </Tooltip>

            {canRemove ? (
                <Tooltip title="Remove">
                    <IconButton
                        aria-label="remove"
                        sx={{color: orange[300]}}
                        onClick={() => setDialogDel(true)}
                    >
                        <DeleteIcon />
                    </IconButton>
                </Tooltip>
            ): (
                <Tooltip title="Remove">
                    <span>
                        <IconButton
                            aria-label="remove"
                            sx={{color: orange[300]}}
                            disabled
                        >
                            <DeleteIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            )}
        </>
    );
}