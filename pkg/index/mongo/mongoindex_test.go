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

package mongo_test

import (
	"errors"
	"sync"
	"testing"
	"time"

	"camlistore.org/pkg/index"
	"camlistore.org/pkg/index/indextest"
	"camlistore.org/pkg/index/mongo"
)

var (
	once              sync.Once
	mongoNotAvailable bool
)

func checkMongoUp() {
	mgw := &mongo.MongoWrapper{
		Servers: "localhost",
	}
	mongoNotAvailable = !mgw.TestConnection(500 * time.Millisecond)
}

func initMongoIndex() *index.Index {
	mgw := &mongo.MongoWrapper{
		Servers:    "localhost",
		Database:   "camlitest",
		Collection: "keys",
	}
	idx, err := mongo.NewMongoIndex(mgw)
	if err != nil {
		panic(err)
	}
	err = idx.Storage().Delete("")
	if err != nil {
		panic(err)
	}
	return idx
}

type mongoTester struct{}

func (mongoTester) test(t *testing.T, tfn func(*testing.T, func() *index.Index)) {
	once.Do(checkMongoUp)
	if mongoNotAvailable {
		err := errors.New("Not running; start a mongoDB daemon on the standard port (27017). The \"keys\" collection in the \"camlitest\" database will be used.")
		t.Fatalf("Mongo not available locally for testing: %v", err)
	}
	tfn(t, initMongoIndex)
}

func TestIndex_Mongo(t *testing.T) {
	mongoTester{}.test(t, indextest.Index)
}

func TestPathsOfSignerTarget_Mongo(t *testing.T) {
	mongoTester{}.test(t, indextest.PathsOfSignerTarget)
}

func TestFiles_Mongo(t *testing.T) {
	mongoTester{}.test(t, indextest.Files)
}