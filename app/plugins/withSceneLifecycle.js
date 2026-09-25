const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

// iOS 27 won't launch an app built with the iOS 27 SDK unless it adopts the
// UIScene life cycle (the TestFlight build crashed in
// UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). Expo ships
// ExpoAppSceneDelegate for this, but the SDK 57 template still uses the
// app-delegate life cycle, so wire it up at prebuild:
//  - Info.plist names EXExpoAppSceneDelegate as the window scene delegate.
//  - AppDelegate becomes an ExpoReactNativeFactoryProvider and stops creating
//    the window / starting React Native itself — the scene delegate does both.
// Drop this once the Expo template adopts scenes on its own.

const START_BLOCK = /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif\n?/;

function withSceneLifecycle(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return c;
  });

  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    let src = c.modResults.contents;
    if (!src.includes('ExpoReactNativeFactoryProvider')) {
      const before = src;
      src = src.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      );
      src = src.replace(START_BLOCK, '');
      if (src === before || src.includes('factory.startReactNative(')) {
        // Fail the build loudly rather than ship an app that crashes at launch.
        throw new Error('withSceneLifecycle: AppDelegate template changed; update the plugin');
      }
    }
    c.modResults.contents = src;
    return c;
  });

  return config;
}

module.exports = withSceneLifecycle;
