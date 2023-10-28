pipeline {
  agent {
    kubernetes {
      yaml '''
        apiVersion: v1
        kind: Pod
        spec:
          nodeSelector: 
            pv: monitoring
          containers:
          - name: docker
            image: public.ecr.aws/z2l3b7u6/gitlab-ci:latestv1
            tty: true
            volumeMounts:
             - mountPath: /var/run/docker.sock
               name: docker-sock
          volumes:
          - name: docker-sock
            hostPath:
              path: /var/run/docker.sock    
        '''
    }
  }

  environment {
    BUILD_NAME = "sportgully-node-backend"
    BUILD_NAME1 = "sportsbuzz11-node-backend"
    BUILD_NAME2 = "sb11-node-backend"
    CI_COMMIT_SHA = sh(returnStdout: true, script: "git rev-parse HEAD").trim()
    GIT_COMMIT_EMAIL = sh (script: 'git --no-pager show -s --format=\'%ae\'',returnStdout: true).trim()
  }

  stages {
    stage('Node Backend Development Build') {
      when {
        beforeInput true
        branch 'development'
      }

      environment{
        BUILD = "$BUILD_NAME1" + "-development"
        ECR = "$SB11_ECR_URL" + "$BUILD"
      }

      steps {
        container('docker') {
          withCredentials([[
            $class: 'AmazonWebServicesCredentialsBinding', credentialsId: "${env.SB11_AWS_CREDS}", accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'], usernamePassword(credentialsId: "${env.SB11_HELM_CREDS}", usernameVariable: 'HELMUNAME', passwordVariable: 'HELMPW')]) {

            sh ''' 
            aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID; aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY; aws configure set default.region $SB11_REGION
            aws eks --region $SB11_REGION update-kubeconfig --name SB11-Dev-Cluster
            helm repo add --username $HELMUNAME --password $HELMPW Sportsbuzz11 $SB11_HELM_URL/development
            helm repo update
            aws s3 cp s3://sportgully-firebase-sdk-1638949745/sportgully-stag-sdk/firebase-sdk.json ./helper/third-party-cred/

            docker build --network=host -t $ECR:$CI_COMMIT_SHA -f Dockerfile.sportgully .
            docker tag $ECR:$CI_COMMIT_SHA $SB11_ECR_URL$ECR:$CI_COMMIT_SHA
            aws ecr get-login-password --region $SB11_REGION | docker login --username AWS --password-stdin $SB11_ECR_URL
            docker push $ECR:$CI_COMMIT_SHA
            helm upgrade --install -n development $BUILD Sportsbuzz11/$BUILD --set=image=$ECR:$CI_COMMIT_SHA
            kubectl rollout status -w deployment/$BUILD -n development
            '''
          }
        }
      }
    }
  
    stage('Node Backend Staging Build') {
      when {
        beforeInput true
        branch 'staging'
      }

      environment{
        BUILD = "$BUILD_NAME" + "-stag"
        ECR = "$SB11_ECR_URL" + "$BUILD"
      }

      steps {
        container('docker') {
          withCredentials([[
            $class: 'AmazonWebServicesCredentialsBinding', credentialsId: "${env.SB11_AWS_CREDS}", accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'], usernamePassword(credentialsId: "${env.SB11_HELM_CREDS}", usernameVariable: 'HELMUNAME', passwordVariable: 'HELMPW')]) {

            sh ''' 
            aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID; aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY; aws configure set default.region $SB11_REGION
            aws eks --region $SB11_REGION update-kubeconfig --name sportgully
            helm repo add --username $HELMUNAME --password $HELMPW Sportsbuzz11 $SB11_HELM_URL/staging
            helm repo update
            aws s3 cp s3://sportgully-firebase-sdk-1638949745/sportgully-stag-sdk/firebase-sdk.json ./helper/third-party-cred/

            docker build --network=host -t $ECR:$CI_COMMIT_SHA -f Dockerfile.sportgully .
            docker tag $ECR:$CI_COMMIT_SHA $SB11_ECR_URL$ECR:$CI_COMMIT_SHA
            aws ecr get-login-password --region $SB11_REGION | docker login --username AWS --password-stdin $SB11_ECR_URL
            docker push $ECR:$CI_COMMIT_SHA
            helm upgrade --install -n staging $BUILD Sportsbuzz11/$BUILD --set=image=$ECR:$CI_COMMIT_SHA
            kubectl rollout status -w deployment/$BUILD -n staging
            '''
          }
        }
      }
    }

    stage('Node Backend Production Build') {
      when {
        beforeInput true
        branch 'production'
      }

      options {
        timeout(time: 2, unit: 'DAYS') 
      }

      input {
        message "Should we continue for Production?"
        ok "Yes, we should."
      }

      environment{
        BUILD = "$BUILD_NAME"
        ECR = "$SB11_ECR_URL" + "$BUILD"
      }

      steps {
        container('docker') {
          withCredentials([[
            $class: 'AmazonWebServicesCredentialsBinding', credentialsId: "${env.SB11_AWS_CREDS}", accessKeyVariable: 'AWS_ACCESS_KEY_ID', secretKeyVariable: 'AWS_SECRET_ACCESS_KEY'], usernamePassword(credentialsId: "${env.SB11_HELM_CREDS}", usernameVariable: 'HELMUNAME', passwordVariable: 'HELMPW')]) {

            sh ''' 
            aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID; aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY; aws configure set default.region $SB11_REGION
            aws eks --region $SB11_REGION update-kubeconfig --name sportgully
            helm repo add --username $HELMUNAME --password $HELMPW Sportsbuzz11 $SB11_HELM_URL/main
            helm repo update
            aws s3 cp s3://sportgully-firebase-sdk-1638949745/sportgully-stag-sdk/firebase-sdk.json ./helper/third-party-cred/

            docker build --network=host -t $ECR:$CI_COMMIT_SHA -f Dockerfile.sportgully .
            docker tag $ECR:$CI_COMMIT_SHA $SB11_ECR_URL$ECR:$CI_COMMIT_SHA
            docker tag $ECR:$CI_COMMIT_SHA $SB11_ECR_URL$ECR:latest
            aws ecr get-login-password --region $SB11_REGION | docker login --username AWS --password-stdin $SB11_ECR_URL
            docker push $ECR:$CI_COMMIT_SHA
            helm upgrade --install -n production $BUILD Sportsbuzz11/$BUILD --set=image=$ECR:$CI_COMMIT_SHA
            helm upgrade --install -n production sportgully-node-backend-reports Sportsbuzz11/sportgully-node-backend-reports --set=image=$ECR:$CI_COMMIT_SHA
            helm upgrade --install -n production sportgully-node-backend-crons Sportsbuzz11/sportgully-node-backend-crons --set=image=$ECR:$CI_COMMIT_SHA
            kubectl rollout status -w deployment/$BUILD -n production
            '''
          }
        }
      }
    }
  }
}
