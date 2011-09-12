# Dropular.net version 2010

Note: This is an archived snapshot of the dropular.net source, May 2010. Some parts has been removed or altered for the sake of security and readability.

## Development

### Starting daily development

Terminal 1:

    ssh -L5984:127.0.0.1:5984 dropular-ec2-1

Terminal 2:

    cd dropular/dropular
    ./build.sh

Terminal 3:

    cd dropular/dropular
    ./httpd.js

### Setting up a local installation

**1. Install node**

You'll need [Node](http://nodejs.org/) v0.1.32 or later.

    $ git clone git://github.com/ry/node.git
    $ cd node
    $ ./configure
    $ make 
    $ sudo make install

**2. Install oui and the dropular site.**

    $ mkdir dropular && cd dropular
    $ git clone git://github.com/rsms/oui.git
    $ git clone git://github.com/rsms/node-couchdb-min.git
    $ git clone git@github.com:rsms/dropular.git

You might need to build the oui library:

    $ cd dropular/oui/client
    $ ./build.sh -s

**3. Install CouchDB**

First, install dependencies.
OS X:

    $ sudo port install icu erlang spidermonkey curl

Debian:

    $ sudo apt-get install build-essential erlang libicu-dev libmozjs-dev\
      libcurl4-openssl-dev

Suck down and build CouchDB:

    $ svn co http://svn.apache.org/repos/asf/couchdb/trunk couchdb
    $ cd couchdb
    $ ./bootstrap && ./configure
    $ make && sudo make install


----

[--deprecated--]

In production, you should configure for prefix "" (that's "/"):

    $ ./configure --prefix ''

And perform the following after `make install`:

    $ sudo adduser --system --home /var/lib/couchdb --no-create-home\
      --shell /bin/bash --group --gecos 'CouchDB Administrator' couchdb
    $ sudo chown -R couchdb.couchdb /var/{lib,log,run}/couchdb /etc/couchdb
    $ sudo chmod -R 0770 /var/{lib,log,run}/couchdb /etc/couchdb

Uninstall is partially possible by running `make uninstall` and then `sudo find /usr/local -iname '*couch*' | sudo xargs rm -rf`.

Create a dropular user and group:

    $ sudo adduser --system --home /var/dropular --shell /bin/bash --group\
      --gecos 'Dropular system user' dropular

Generate an SSH key for the dropular user:

    $ sudo su dropular
    $ cd
    $ ssh-keygen -t rsa
    $ cat .ssh/id_rsa.pub

Copy the output from the last command and add a new "deploy key" in https://github.com/rsms/dropular/edit

Check out the dropular repo, logged in as `dropular`:

    $ git clone git@github.com:rsms/dropular.git /var/dropular/dropular

Create a symlink in `/var/www`:

    $ ln -s /var/dropular/dropular /var/www/dropular.net/www

#### Deploying a new version of dropular-httpd

First thing, start a server instance in debug mode on an unused port:

    $ sudo -u dropular /var/dropular/dropular/httpd.js -d -p 9000

Then, test with a client directly:

    $ open 'http://dropular.net:9000/'

Then test with a client partially:

    $ open 'http://dropular.net/#OUI_DEBUG_BACKEND=dropular.net:9000'

If everything look jolly good, restart all live server instances:

    $ sudo invoke-rc.d dropular-httpd restart

Aaand test the live client:

    $ open 'http://dropular.net/'


### Client development

When developing the client, you need to build it. The `build.sh` file does this for you automatically. In a terminal:

    $ ./build.sh -fO 0

> `-fO 0` -- The `f` flag causes the first build to be "complete" (forced). The `O` flag sets the optimization level to zero, making debugging possible.

Keep this running in a terminal -- when a file has been changed, the client will automatically be rebuilt.


### Server development

When developing the server, you need to (re)start `httpd.js` when something changes in the server code.

    $ ./httpd.js -d

> `-d` -- The `d` flag causes debugging to be enabled.


## MIT license

Copyright (c) 2009-2010 Rasmus Andersson <http://rsms.me/>, Andreas Pihlström <http://suprb.com/>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
