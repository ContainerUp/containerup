import {Button, DialogActions} from "@mui/material";
import {useState} from "react";

export default function ImagePullActions({onClose, onConfirm, pulling, imageName, pullTerminationOnReceive}) {
    const [done, setDone] = useState(false);

    pullTerminationOnReceive(() => {
        setDone(true);
    });

    return (
        <DialogActions>
            {!done ? (
                <>
                    <Button onClick={onClose} disabled={pulling}>
                        Cancel
                    </Button>
                    <Button onClick={onConfirm} disabled={pulling || imageName === ''}>
                        Pull
                    </Button>
                </>
            ) : (
                <Button onClick={onClose}>
                    Close
                </Button>
            )}
        </DialogActions>
    );
}