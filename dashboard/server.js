const express = require("express");
const path = require("path");
const helmet = require("helmet");

const app = express();
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),

                "connect-src": [
                    "'self'",
                    "https://a7fls5fve5.execute-api.us-east-1.amazonaws.com"
                ]
            }
        }
    })
);
const port = 3000;


// Serve dashboard files
app.use(express.static(__dirname));


app.get("/", (req, res) =>
{
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});


app.listen(port, () =>
{
    console.log(
        `Dashboard server running on http://localhost:${port}`
    );
});