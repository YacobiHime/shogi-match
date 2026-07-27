# Upstream and assets

The complete shogi-match runtime is distributed under GPL-3.0-or-later.
The following embedded upstream components retain their original permissive terms.

This package contains an extracted and adapted copy of the board primitive from
[ShogiHome 1.28.0](https://github.com/sunfish-shogi/shogihome), including its
board geometry, interaction, promotion selector, last-move marker, and
candidate-arrow rendering.

MIT License

Copyright (c) 2022 Kubo Ryosuke

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

- Move validation and SFEN parsing use [tsshogi](https://github.com/sunfish-shogi/tsshogi),
  distributed under the MIT License.
- The bundled piece images originate from
  [shogi-images](https://sunfish-shogi.github.io/shogi-images/) and are
  dedicated to the public domain under CC0 1.0.
- The selectable board images also originate from shogi-images under CC0 1.0.
