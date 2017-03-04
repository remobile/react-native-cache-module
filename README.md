# React Native Cache Module (remobile)
Cache dynamic loading third party react-native app/module for react-native
## Installation
```sh
npm install @remobile/react-native-cache-module --save
```

## Usage

### Example
```js
'use strict';

var React = require('react');
var ReactNative = require('react-native');
var {
    StyleSheet,
    View,
} = ReactNative;

var Button = require('@remobile/react-native-simple-button');
var CacheModule = require('@remobile/react-native-cache-module');
var Module = require('@remobile/react-native-module');

module.exports = React.createClass({
    test() {
        CacheModule.getModulePath('http://localhost:3001/fang').then((path)=>{
            Module.load(path, 'SimpleApp', {fang:1, yun:2}, (result)=>{
                Toast(JSON.stringify(result));
            });
        });
    },
    render() {
        return (
            <View style={styles.container}>
                <Button onPress={this.test}>测试</Button>
            </View>
        );
    }
});


var styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'space-around',
        paddingVertical: 150,
    },
});
```
### Screencasts

![demo](https://github.com/remobile/react-native-cache-module/blob/master/screencasts/demo.gif)

### Method
- `getModulePath(url): PropTypes.function.Promize` Promize resolve the local path of module

### Server Static Files
```
$ls -R
fang

./fang:
ios.zip      version.json
```

* ios.zip is the ios js bundle and resource
* version.json format like below:

```
{
    "ios": 1,
    "android": 1,
}
```

### see detail use
* https://github.com/remobile/react-native-template
