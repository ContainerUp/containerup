import {TableCell, TableRow} from "@mui/material";

export default function MyTableRowSingle({cols, children}) {
    return (
        <TableRow key={0}>
            <TableCell component="th" colSpan={cols} align="center">
                {children}
            </TableCell>
        </TableRow>
    );
}