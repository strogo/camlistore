/*
Copyright 2011 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package server

import (
	"errors"

	"camlistore.org/pkg/blob"
	"camlistore.org/pkg/lru"
)

const cacheSize = 1024

// ScaledImage is a mapping between the blobref of an image and
// its scaling parameters, and the blobref of such a rescaled
// version of that image.
// Key will be some string containing the original full-sized image's blobref,
// its target dimensions, and any possible transformations on it (e.g. cropping
// it to square). This string packing should not be parsed by a ScaledImage
// implementation and is not guaranteed to be stable over time.
type ScaledImage interface {
	Get(key string) (blob.Ref, error) // returns ErrCacheMiss when item not in cache
	Put(key string, br blob.Ref) error
}

var ErrCacheMiss = errors.New("not in cache")

type ScaledImageLRU struct {
	nameToBlob *lru.Cache // string (see key format) -> blob.Ref
}

func NewScaledImageLRU() *ScaledImageLRU {
	sc := &ScaledImageLRU{
		nameToBlob: lru.New(cacheSize),
	}
	return sc
}

func (sc *ScaledImageLRU) Get(key string) (blob.Ref, error) {
	br, ok := sc.nameToBlob.Get(key)
	if !ok {
		return blob.Ref{}, ErrCacheMiss
	}
	return br.(blob.Ref), nil
}

func (sc *ScaledImageLRU) Put(key string, br blob.Ref) error {
	sc.nameToBlob.Add(key, br)
	return nil
}
