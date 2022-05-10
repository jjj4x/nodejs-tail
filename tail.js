const fs = require('fs');
const fsAsync = require('fs').promises;

const FILENAME = './udhcpd.conf';
const LINES_COUNT = 3;
const SEPARATOR = '\n';
const ENCODING = 'utf8';
const CHUNK_SIZE = 1024;


class File {
    constructor(filename, size, linesCount, separator, encoding, chunkSize) {
        this.filename = filename;
        this.size = size;
        this.separator = separator || SEPARATOR;
        this.encoding = encoding || ENCODING;
        this.chunkSize = chunkSize || CHUNK_SIZE;
        this.pos = Math.max(this.size - this.chunkSize, 0);
        this.pointer = this.pos;
        this.buffer = null;
        this.savedBuffer = '';
        this.linesCount = linesCount;
        this.lastLineStartInChunk = this.pos;
        this.start = 0;
    }

    searchBuffer() {
        if (this.buffer === null) {
            return false;
        }
        let separatorPos = this.buffer.lastIndexOf(this.separator);
        let savedBuffer;
        if (this.pos <= 0 && separatorPos === -1) {
            let lastLine = this.buffer;
            this.buffer = '';
            savedBuffer = this.savedBuffer;
            this.savedBuffer = "";
            return lastLine + savedBuffer;
        }
        if (separatorPos === -1) {
            this.pointer = this.pos - this.chunkSize - 1;
            this.pos = this.pointer;
            this.savedBuffer = this.buffer + this.savedBuffer;
            this.buffer = "";
            return false;
        } else {
            let line = this.buffer.substr(separatorPos + this.separator.length, this.buffer.length);

            this.linesCount -= 1;
            this.lastLineStartInChunk = separatorPos + 1;

            this.buffer = this.buffer.substr(0, separatorPos);
            savedBuffer = this.savedBuffer;
            this.savedBuffer = "";
            return line + savedBuffer;
        }
    };
}


async function _processChunk(file, linesCount) {
    let stream = fs.createReadStream(
        file.filename,
        {
            start: Math.max(file.pointer, 0),
            end: Math.max(file.pointer + file.chunkSize, 0),
            encoding: file.encoding
        }
    );

    for await (const chunk of stream) {
        if (linesCount <= 0) {
            break
        }

        file.buffer = chunk;
        while (true) {
            if (linesCount <= 0 || file.buffer === '') {
                break
            }

            let line = file.searchBuffer();

            if (line)
                --linesCount;
        }
    }

    return linesCount
}


async function seekBackwards(file) {
    console.debug('Seeking backwards');

    let linesCount = file.linesCount;

    while (file.pos > 0 || file.buffer == null) {
        if (linesCount <= 0) {
            break
        }

        linesCount = await _processChunk(file, linesCount);
    }

    if (linesCount <= 0)
        file.start = file.pos + file.lastLineStartInChunk;
}


async function readLines(file) {
    console.debug(`Reading lines in ${file.filename} from ${file.start} to ${file.size}`)

    let stream = fs.createReadStream(
        file.filename,
        {
            start: file.start,
            end: file.size,
            encoding: file.encoding
        }
    );

    for await (const chunk of stream)
        console.log(chunk);
}


async function main(file) {
    await seekBackwards(file);
    await readLines(file);
}


if (require.main === module) {
    (async () => {
        let size = (await fsAsync.stat(FILENAME)).size
        let file = new File(FILENAME, size, LINES_COUNT);
        await main(file);
    })();
}
