import {
  CloudFrontKeyValueStoreClient,
  DescribeKeyValueStoreCommand,
} from "@aws-sdk/client-cloudfront-keyvaluestore";
import {
  getSmithyContext,
} from "@smithy/util-middleware";

(async () => {
  // Assumes credentials are available through the default credential chain
  const client = new CloudFrontKeyValueStoreClient({
    region: "us-east-1",
  });
  client.middlewareStack.identifyOnResolve(true);
  client.middlewareStack.addRelativeTo((next, context) => args => {
    // console.log(JSON.stringify(context, null, 2));
    return next(args);
  }, {
    name: "CUSTOM CONTEXT IDENTIFIER",
    toMiddleware: "httpSigningMiddleware",
    relation: "after",
  });

  // Customization for a specific endpoint without SigV4A
  client.middlewareStack.addRelativeTo(
    (next, context) => async (args) => {
      const authScheme = context.endpointV2?.properties?.authSchemes?.[0];
      authScheme.name = "sigv4";
      delete authScheme.signingRegionSet;
      authScheme.signingRegion = "us-east-1";

      const smithyContext = getSmithyContext(context);
      const httpAuthOption = smithyContext?.selectedHttpAuthScheme?.httpAuthOption;

      // If I&A is enabled, edit this
      if (httpAuthOption) {
        httpAuthOption.signingProperties = Object.assign(
          httpAuthOption.signingProperties || {},
          {
            signing_region: authScheme.signingRegion,
            signingRegion: authScheme.signingRegion,
            signing_service: authScheme.signingName,
            signingName: authScheme.signingName,
            signingRegionSet: authScheme.signingRegionSet,
          },
          authScheme.properties
        );
      }
      return next(args);
    },
    {
      name: "override-authScheme-middleware",
      override: true,
      toMiddleware: "endpointV2Middleware",
      relation: "after",
    }
  );
  const command = new DescribeKeyValueStoreCommand({
    KvsARN: "TODO INSERT ARN HERE",
  });
  console.log({
    response: await client.send(command)
  });
})();
