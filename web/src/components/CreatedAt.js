import {Tooltip} from "@mui/material";
import timeUtil from "../lib/timeUtil";
import {useEffect, useState} from "react";

export default function CreatedAt({created3339Nano = null, createdUnixTimestamp = 0}) {
    const [version, setVersion] = useState(0);

    let createDate;
    if (created3339Nano) {
        createDate = timeUtil.parseRFC3339Nano(created3339Nano);
    }
    if (createdUnixTimestamp) {
        createDate = new Date(createdUnixTimestamp * 1000);
    }

    const [createAgo, refreshCreateAgo] = timeUtil.dateAgo(createDate);

    useEffect(() => {
        if (refreshCreateAgo < 0) {
            return;
        }
        const timeout = setTimeout(() => {
            setVersion(v => v + 1);
        }, refreshCreateAgo * 1000);
        return () => clearTimeout(timeout);
    });

    return (
        <Tooltip title={createDate.toLocaleString()} key={version}>
            <span>
                {createAgo}
            </span>
        </Tooltip>
    );
}