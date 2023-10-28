import {TableCell, TableRow, Skeleton} from "@mui/material";

export default function MyTableRowsLoader({cols, rows, sx}) {
    return (
        <>
            {[...Array(rows)].map((row, index) => (
                <TableRow key={index} sx={sx}>
                    {[...Array(cols)].map((col, j) => (
                        <TableCell key={j}>
                            <Skeleton animation="wave" variant="text" />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}