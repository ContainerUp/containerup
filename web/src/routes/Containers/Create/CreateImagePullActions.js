import {Button, DialogActions} from "@mui/material";
import {useState} from "react";

export default function CreateImagePullActions({onClose, onConfirm, pulling, pullTerminationOnReceive}) {
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
                    <Button onClick={onConfirm} disabled={pulling}>
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